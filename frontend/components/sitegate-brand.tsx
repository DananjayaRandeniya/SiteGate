import Image from "next/image";

export function SiteGateBrand() {
  return (
    <span className="inline-flex items-center gap-2.5 text-[21px] font-bold">
      <span className="grid size-[34px] shrink-0 place-items-center rounded-control bg-accent">
        <Image
          src="/sitegate-shield.png"
          alt=""
          width={19}
          height={22}
          unoptimized
        />
      </span>
      SiteGate
    </span>
  );
}
