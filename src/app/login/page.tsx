// src/app/login/page.tsx  (Server)
import type { Metadata } from "next";
import LoginScreen from "./LoginScreen";
import SidebarMenu, { Rol } from "@/app/Components/Menu/Menu";

export const metadata: Metadata = { title: "Login | Cosaif Logistics" };

export default function Page() {
  return (
    <>
      <SidebarMenu />
      <LoginScreen />
    </>
  );
}
