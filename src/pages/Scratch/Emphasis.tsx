// a rule line marks the words it leans on with **, so each language keeps its own word order
const Emphasis = ({ text, strong }: { text: string; strong: string }) => (
  <>
    {text.split("**").map((part, i) =>
      i % 2 ? (
        <b key={i} className={strong}>
          {part}
        </b>
      ) : (
        part
      )
    )}
  </>
);

export default Emphasis;
