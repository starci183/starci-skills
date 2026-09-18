/**
 * The Grammar core: a small set of primitive leaves the product composes. Each one owns only intrinsic
 * rendering of its own markup; none of them read product data, session, routing or transport. Theme
 * colours live in ./styles.css, never inline here. Every public prop shape is a closed, locally declared
 * contract - no leaf forwards an open-ended DOM attribute bag or an arbitrary React child, so every field
 * stays a resolvable, readonly value the check-scoped-lint canon can verify without leaving this file.
 */

/** The public props of the one clickable action leaf, GrammarButton. */
export type GrammarButtonProps = {
  readonly type: 'button' | 'submit';
  readonly isDisabled?: boolean;
  readonly onClick?: () => void;
  readonly children: string;
};

/** The one clickable action leaf; product code never renders a raw `<button>`. */
export const GrammarButton = (props: GrammarButtonProps) => {
  return (
    <button type={props.type} className="grammar-button" disabled={props.isDisabled} onClick={props.onClick}>
      {props.children}
    </button>
  );
};

/** The public props of the one labelled single-line input leaf, GrammarTextField. */
export type GrammarTextFieldProps = {
  readonly id: string;
  readonly label: string;
  readonly kind?: 'text' | 'email' | 'password';
  readonly value: string;
  readonly onChange: (value: string) => void;
};

/** The one labelled single-line input leaf; product code never renders a raw `<input>` with a label. */
export const GrammarTextField = (props: GrammarTextFieldProps) => {
  return (
    <div className="grammar-field">
      <label htmlFor={props.id}>{props.label}</label>
      <input id={props.id} type={props.kind ?? 'text'} value={props.value} onChange={event => props.onChange(event.target.value)} />
    </div>
  );
};

/** The public props of the one inline status message leaf, GrammarMessage. */
export type GrammarMessageProps = {
  readonly tone: 'danger';
  readonly children: string | null;
};

/** The one inline status message leaf; its role carries the tone so assistive tech announces it. */
export const GrammarMessage = (props: GrammarMessageProps) => {
  return (
    <p className={`grammar-message-${props.tone}`} role={props.tone === 'danger' ? 'alert' : undefined}>
      {props.children}
    </p>
  );
};
