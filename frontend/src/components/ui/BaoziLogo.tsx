import Image from "next/image";

export default function BaoziLogo({ size = 36 }: { size?: number }) {
  return (
    <Image
      src="/logo.png"
      alt="Tangbao logo"
      width={size}
      height={size}
      style={{ objectFit: "contain" }}
      priority
    />
  );
}
