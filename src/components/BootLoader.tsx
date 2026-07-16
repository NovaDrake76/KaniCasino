// the same markup index.html paints before the bundle arrives. react tears the html one
// out on its first render, so if the suspense fallback were anything else the screen
// would go blank between the two while the route chunk downloads. the classes and the
// keyframes live in index.html.
const BootLoader = () => (
  <div className="boot">
    <div className="boot-ring" />
    <p className="boot-word">KANICASINO</p>
  </div>
);

export default BootLoader;
