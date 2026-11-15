import { ClockViewProps } from "./Clock.types";

const ClockView: React.FC<ClockViewProps> = ({ text }) => <span data-testid="today-clock">{text}</span>;

export default ClockView;
