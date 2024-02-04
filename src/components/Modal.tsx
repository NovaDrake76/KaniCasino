import { IoMdClose } from "react-icons/io";

interface ModalProps {
  children: JSX.Element;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const Modal: React.FC<ModalProps> = ({ children, open, setOpen }) => {
  if (!open) return null;

  /* function to close when clicking outside modal */
  const handleClose = (e: any) => {
    if (e.target.id === "wrapped") {
      setOpen(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-25 backdrop-blur-sm z-50"
      id="wrapped"
      onClick={handleClose}
    >
      <div className="w-[600px] max-h-[70vh] flex flex-col overflow-auto">
        <div className="p-6 text-white rounded bg-[#19172D] relative">

          {/* X button to close modal */}
          <button
            className="absolute top-2 right-2 text-2xl bg-none  border-none place-self-end bg-inherit focus:outline-none"
            onClick={() => setOpen(false)}>
            <IoMdClose />
          </button>

          {/* all Modal content */}
          <div className="mt-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal;
