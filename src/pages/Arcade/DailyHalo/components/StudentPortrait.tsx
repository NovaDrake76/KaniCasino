type Variant = "square" | "round" | "hero" | "dot";

interface Props {
  src: string;
  name: string;
  variant: Variant;
  className?: string;
  dim?: boolean;
}

const faceIcon = (portrait: string) => portrait.replace("/images/student/portrait/", "/images/student/icon/");

// schaledb portraits are full-body; this is the crop the original daily halo used for its
// list tiles and guess rows
const CROP: Record<"square" | "round", { box: string; strip: string }> = {
  square: { box: "h-24 w-24 rounded-xl", strip: "w-40" },
  round: { box: "h-20 w-20 rounded-full md:h-24 md:w-24", strip: "w-36" },
};

const StudentPortrait = ({ src, name, variant, className = "", dim }: Props) => {
  if (variant === "dot") {
    return <img src={faceIcon(src)} alt="" className={`h-6 w-6 rounded-full object-cover ${className}`} />;
  }
  if (variant === "hero") {
    return (
      <img
        src={src}
        alt={name}
        draggable={false}
        className={`h-40 w-40 rounded-full bg-white/40 object-cover object-top shadow-2xl ring-8 ${dim ? "ring-slate-500 grayscale" : "ring-white"} ${className}`}
      />
    );
  }
  const crop = CROP[variant];
  return (
    <div className={`flex-shrink-0 overflow-hidden bg-slate-100 ${crop.box} ${className}`}>
      <div className={`flex overflow-hidden ${crop.strip}`}>
        <img src={src} alt={name} loading="lazy" draggable={false} className="-ml-6 h-full w-auto scale-125 object-cover object-top" />
      </div>
    </div>
  );
};

export default StudentPortrait;
