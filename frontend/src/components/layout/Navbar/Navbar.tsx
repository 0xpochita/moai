import { NavbarBrand } from "./NavbarBrand";
import { NavbarLinks } from "./NavbarLinks";
import { NavbarThemeToggle } from "./NavbarThemeToggle";
import { NavbarWallet } from "./NavbarWallet";

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 mx-auto w-full max-w-6xl px-4 pt-4 md:px-6">
      <div className="bg-elevated ring-card flex items-center justify-between rounded-full p-1.5 backdrop-blur">
        <div className="flex items-center gap-6">
          <NavbarBrand />
          <NavbarLinks />
        </div>
        <div className="flex items-center gap-2 pr-1">
          <NavbarThemeToggle />
          <NavbarWallet />
        </div>
      </div>
    </header>
  );
}
