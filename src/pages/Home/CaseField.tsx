// the dot field behind a run of case shelves. it wraps the whole run rather than each
// shelf, because a field that stopped and restarted left a seam wherever two shelves met
const CaseField = ({ children }: { children: React.ReactNode }) => (
  <div className="relative isolate">
    <div aria-hidden className="case-field absolute inset-0 -z-10" />
    {children}
  </div>
);

export default CaseField;
