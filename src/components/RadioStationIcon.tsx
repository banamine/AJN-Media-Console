interface RadioStationIconProps {
  src: string;
  alt: string;
}

export function RadioStationIcon({ src, alt }: RadioStationIconProps) {
  return (
    <img
      src={src}
      alt={alt}
      className="w-8 h-8 rounded-xl object-contain shrink-0 border border-slate-800 bg-white p-1"
      referrerPolicy="no-referrer"
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = "https://archive.org/download/daily-highlights/lmbsa.png";
      }}
    />
  );
}
