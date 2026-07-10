export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <img src="/logo.png" alt="" width={size} height={size} className="rounded-xl" />
      <span
        className="font-display font-bold tracking-tight text-brand-800"
        style={{ fontSize: size * 0.6 }}
      >
        Compatilo
      </span>
    </div>
  );
}
