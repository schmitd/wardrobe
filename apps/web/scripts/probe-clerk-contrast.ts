import { chromium } from 'playwright';
import { clerkAppearance, clerkColors as c } from '../src/lib/clerk-appearance';
import { mkdir, writeFile, readFile } from 'node:fs/promises';

// Synthetic local fixture: exercises the shared appearance rules without an
// auth session or calls to Clerk/Google. This is not a live Clerk DOM assertion.
const css = (style: Record<string, unknown>, selector: string): string => {
  let declarations = '', nested = '';
  for (const [name, value] of Object.entries(style)) {
    if (typeof value === 'object' && value) nested += css(value as Record<string, unknown>, name.replace('&', selector));
    else declarations += `${name.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}:${value};`;
  }
  return `${selector}{${declarations}}${nested}`;
};
const styles = Object.entries(clerkAppearance.elements).map(([name, value]) => css(value, `.${name}`)).join('\n');
const globalStyles = await readFile(new URL('../src/app/globals.css', import.meta.url), 'utf8');
const customMenuStyles = globalStyles.slice(globalStyles.indexOf('/* Clerk custom account links'), globalStyles.indexOf('/* End Clerk custom account links. */'));
if (!customMenuStyles) throw Error('Missing custom account-link styles');
const markup = `<!doctype html><html><head><style>
body{font:14px Arial;color:${c.ink};background:${c.paper};padding:24px}section{margin:20px 0;padding:20px;background:${c.lavender};max-width:480px}button,a,input{padding:10px;margin:6px;font:inherit}a{display:inline-block}svg{width:16px;height:16px} ${styles} ${customMenuStyles}
</style></head><body>
<section class="userButtonPopoverCard" aria-label="Account menu">
<p class="userPreviewMainIdentifier">Sample account</p><p class="userPreviewSecondaryIdentifier">sample@example.test</p>
${['Manage account','Sign out'].map(label => `<button class="userButtonPopoverActionButton"><svg class="userButtonPopoverActionButtonIcon" fill="currentColor" viewBox="0 0 16 16"><rect width="16" height="16" /></svg><span class="userButtonPopoverActionButtonText">${label}</span></button>`).join('')}
<button class="cl-userButtonPopoverCustomItemButton" style="color:color(srgb .141176 .0784314 .14902 / .62)"><span class="cl-userButtonPopoverCustomItemButtonIconBox"><div class="cl-userButtonPopoverActionItemButtonIcon"><svg class="lucide lucide-shield" stroke="currentColor" fill="none" viewBox="0 0 16 16"><path d="M1 1h14v14H1z" /></svg></div></span>Privacy</button>
</section>
${['Manage account','Sign in','Sign up'].map(title => `<section class="card" aria-label="${title}"><h2 class="headerTitle">${title}</h2><p class="headerSubtitle">Synthetic account information</p><button class="navbarButton"><span class="navbarButtonText">Profile</span></button><label class="formFieldLabel">Email<input class="formFieldInput" value="sample@example.test" /></label><input class="formFieldInput" placeholder="Email" /><p class="formFieldErrorText">Enter a valid email address</p><button class="socialButtonsBlockButton"><span class="socialButtonsBlockButtonText">Continue with Google</span></button><button class="formButtonPrimary">Continue</button><button class="formButtonPrimary" disabled>Unavailable</button><input class="formFieldInput" disabled value="Unavailable" /><a class="footerPagesLink" href="#privacy">Privacy</a></section>`).join('')}
</body></html>`;
const browser = await chromium.launch({headless:true, channel: "chrome"});
const page = await browser.newPage({viewport:{width:980,height:1600}});
await page.route('**/*', route => route.abort());
await page.setContent(markup);
const measurements = await page.evaluate(() => {
  const rgb = (color: string) => color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
  const lum = (color: string) => rgb(color).map(n => {n /= 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4;}).reduce((s,n,i) => s + n * [.2126,.7152,.0722][i],0);
  const ratio = (fg:string,bg:string) => (Math.max(lum(fg),lum(bg))+.05)/(Math.min(lum(fg),lum(bg))+.05);
  return [...document.querySelectorAll('h2,p,span,input,a,button,svg')].filter(el => !(el.tagName === 'BUTTON' && el.children.length)).map(el => {
    const s = getComputedStyle(el); let parent: Element | null = el; let background = '';
    while(parent) {background=getComputedStyle(parent).backgroundColor; if(background !== 'rgba(0, 0, 0, 0)') break; parent=parent.parentElement;}
    return {element:el instanceof SVGElement ? el.className.baseVal : el.className, text:el.textContent?.slice(0,40), foreground:s.color,background,opacity:s.opacity,ratio:ratio(s.color,background),target:el.tagName === 'svg' ? 3 : 4.5};
  });
});
for(const entry of measurements) if(entry.ratio < entry.target) throw Error(JSON.stringify(entry));
await page.locator('.userButtonPopoverActionButton').first().hover();
const hover = await page.locator('.userButtonPopoverActionButton').first().evaluate(el => ({foreground:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor}));
await page.keyboard.press('Tab');
await page.locator('.userButtonPopoverActionButton').first().focus();
const focus = await page.locator('.userButtonPopoverActionButton').first().evaluate(el => ({outline:getComputedStyle(el).outline,offset:getComputedStyle(el).outlineOffset}));
if(!focus.outline.includes('2px') || !focus.outline.includes('solid')) throw Error('Missing focus indicator');
await page.locator('.cl-userButtonPopoverCustomItemButton').focus();
const custom = await page.locator('.cl-userButtonPopoverCustomItemButton').evaluate(el => ({foreground:getComputedStyle(el).color,icon:getComputedStyle(el.querySelector('svg')!).color,outline:getComputedStyle(el).outline,focusVisible:el.matches(':focus-visible')}));
if (custom.foreground !== 'rgb(36, 20, 38)' || custom.icon !== custom.foreground || !custom.focusVisible || !(custom.outline.includes('2px') && custom.outline.includes('solid'))) throw Error(JSON.stringify(custom));
const out = new URL('../../../output/playwright/',import.meta.url);
await mkdir(out,{recursive:true});
await writeFile(new URL('clerk-contrast.json',out),JSON.stringify({scope:'Synthetic rendering of shared appearance rules; not live Clerk DOM',measurements,hover,focus,custom},null,2));
await page.screenshot({path:new URL('clerk-contrast.png',out).pathname,fullPage:true});
console.log(JSON.stringify({checks:measurements.length,minimumTextRatio:Math.min(...measurements.filter(e=>e.target===4.5).map(e=>e.ratio)),hover,focus,custom}));
await browser.close();
