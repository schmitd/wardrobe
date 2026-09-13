import { replayPrivacy } from "../src/lib/replay-privacy";

const events = [];
const stop = window.rrweb.record({ ...replayPrivacy, emit: event => events.push(event) });
const image = document.createElement("img");
image.src = "/PRIVATE_DYNAMIC_PHOTO";
image.alt = "PRIVATE_DYNAMIC_DESCRIPTION";
document.querySelector("main").append(image);
const note = document.createElement("p");
note.textContent = "PRIVATE_DYNAMIC_NOTE";
document.querySelector("main").append(note);
setTimeout(() => {
  stop();
  const serialized = JSON.stringify(events);
  const markers = ["PRIVATE_PHOTO", "PRIVATE_NOTE", "PRIVATE_PASSWORD", "PRIVATE_FILE", "PRIVATE_DYNAMIC_PHOTO", "PRIVATE_DYNAMIC_DESCRIPTION", "PRIVATE_DYNAMIC_NOTE"];
  const leaked = markers.filter(marker => serialized.includes(marker));
  const snapshots = events.filter(event => event.type === 2).length;
  const mutations = events.filter(event => event.type === 3).length;
  document.querySelector("output").textContent = JSON.stringify({ passed: leaked.length === 0 && snapshots > 0 && mutations > 0, leaked, snapshots, mutations });
}, 250);
