// a tiny navigation bridge so code outside the Router tree (e.g. a toast fired from
// App, which sits above <Router>) can trigger client-side navigation. A component
// inside the Router registers react-router's navigate here.
type NavFn = (to: string) => void;

let navigateFn: NavFn | null = null;

export const setNavigator = (fn: NavFn | null) => {
  navigateFn = fn;
};

export const navigateTo = (to: string) => {
  if (navigateFn) navigateFn(to);
};
