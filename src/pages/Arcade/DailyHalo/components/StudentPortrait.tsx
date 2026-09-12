interface Props {
  src: string;
  name: string;
  className?: string;
  dim?: boolean;
  // a small square: schaledb's face icon for the same student instead of the full-body art
  face?: boolean;
}

const faceIcon = (portrait: string) => portrait.replace("/images/student/portrait/", "/images/student/icon/");

// schaledb portraits are full-body, so the large frame zooms in on the face
const StudentPortrait = ({ src, name, className = "", dim, face }: Props) => (
  <div className={`relative flex-shrink-0 overflow-hidden bg-surface-raised ${className}`}>
    {face ? (
      <img
        src={faceIcon(src)}
        alt={name}
        loading="lazy"
        draggable={false}
        className={`h-full w-full object-cover ${dim ? "grayscale opacity-60" : ""}`}
      />
    ) : (
      <img
        src={src}
        alt={name}
        loading="lazy"
        draggable={false}
        className={`absolute left-1/2 top-0 w-[180%] max-w-none -translate-x-1/2 ${dim ? "grayscale opacity-60" : ""}`}
      />
    )}
  </div>
);

export default StudentPortrait;
