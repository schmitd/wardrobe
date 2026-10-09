"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
const GuestChoice = createContext({ guest: false, chooseGuest: () => {}, useAccount: () => {} });
/** Only explicit guest intent survives auth remounts. No photos, IDs or query data. */
export function GuestChoiceProvider({children}:{children:ReactNode}) {
  const [guest,setGuest] = useState(false);
  return <GuestChoice.Provider value={{guest,chooseGuest:()=>setGuest(true),useAccount:()=>setGuest(false)}}>{children}</GuestChoice.Provider>;
}
export const useGuestChoice = () => useContext(GuestChoice);
