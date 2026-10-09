import {expect,test} from "bun:test";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import WardrobeShell from "./WardrobeShell";
test("server shell reserves style, collection and piece areas before auth or JavaScript",()=>{
 const html=renderToStaticMarkup(<WardrobeShell/>);
 expect(html).toContain("Your style");
 expect(html).toContain("Collections");
 expect(html).toContain("Loading pieces");
 expect(html).toContain('aria-busy="true"');
 expect(html).not.toContain("Restoring your session");
 expect(html).toContain("New collection");
 expect(html).not.toContain("<button");
 expect(html).not.toContain("<img");
 expect(html).not.toContain("data-private");
 expect(html).not.toContain("Sign in");
 expect(html).not.toContain("data-wardrobe-item-id");
});
