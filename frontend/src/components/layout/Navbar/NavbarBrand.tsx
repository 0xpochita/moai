import Image from "next/image";

export function NavbarBrand() {
  return (
    <div className="flex items-center gap-2 pl-2">
      <Image
        src="/Assets/Images/logo-brand/moai-logo.svg"
        width={35}
        height={35}
        alt="logo"
      />
    </div>
  );
}
