import { FanCardData, FanCardStyleId } from "../cardTypes";

export interface ShareCardProps {
  data: FanCardData;
  // whether the viewer currently leads a board, which is what opens the poster styles
  leadsABoard: boolean;
  onClose: () => void;
}

export interface ShareCardViewProps {
  data: FanCardData;
  styles: FanCardStyleId[];
  at: number;
  styleId: FanCardStyleId;
  label: string;
  loading: boolean;
  error: string | null;
  said: string | null;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  go: (index: number) => void;
  step: (delta: number) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  share: () => void;
  copy: () => void;
  save: () => void;
  onClose: () => void;
}
