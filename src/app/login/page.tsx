// src/app/login/page.tsx  (Server)
import type { Metadata } from "next";
import LoginScreen from "./LoginScreen";

export const metadata: Metadata = { title: "Login | Cosaif Logistics" };

export default function Page() {
  return (
    <>
   
      <LoginScreen />
    </>
  );
}
 