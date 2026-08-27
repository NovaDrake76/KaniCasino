import Title from "../Title";

interface GameLayoutProps {
  title?: string;
  panel: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  // the strip under the canvas. opt-in, so a game that migrates into this shell later
  // does not silently inherit controls it cannot feed.
  bar?: React.ReactNode;
}

// the shared shell every game page sits in: one container holding the controls and the board.
// the board comes first on phones, so the game is on screen without scrolling past a tall
// stack of controls to reach it.
const GameLayout: React.FC<GameLayoutProps> = ({ title, panel, children, footer, bar }) => (
  <div className="w-full flex flex-col items-center gap-6 px-3 sm:px-4 pt-4 pb-10">
    {title && <Title title={title} compact />}

    <div className="w-full max-w-[1200px] flex flex-col bg-surface rounded-lg overflow-hidden border border-line">
      <div className="flex flex-col-reverse lg:flex-row">
        <div className="w-full lg:w-[320px] shrink-0 flex flex-col gap-3 p-4 sm:p-5 border-t lg:border-t-0 lg:border-r border-line">
          {panel}
        </div>
        <div className="flex-1 min-w-0 flex items-center justify-center p-3 sm:p-6">
          {children}
        </div>
      </div>
      {bar}
    </div>

    {footer}
  </div>
);

export default GameLayout;
