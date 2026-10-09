import React,{lazy,Suspense} from "react";
import HomeSectionBoundary from "../../src/components/HomeSectionBoundary";
import WardrobeShell from "../../src/components/WardrobeShell";
// Isolated mechanism probe: a rejected React.lazy loader is cached until reload.
const Section=lazy(async()=>{
 if(!sessionStorage.getItem("fixture.moduleAttempt")) {
  sessionStorage.setItem("fixture.moduleAttempt","failed");
  throw new Error("Synthetic module download failed");
 }
 return {default:()=> <h1>Recovered wardrobe module</h1>};
});
export default function ModuleRecoveryFixture(){return <HomeSectionBoundary title="Wardrobe module" retryLabel="Reload wardrobe" reloadOnRetry><Suspense fallback={<WardrobeShell/>}><Section/></Suspense></HomeSectionBoundary>;}
