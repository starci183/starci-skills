# Radius

The radius scale has ONE root token and every other step is a multiple of it. A set of loose values
chosen by hand looks identical on the first screen and stops looking like anything by the tenth.

## 1. One root value generates the scale

Take a root of 8px and derive: 0.25x for a hairline corner (2px), 1.5x for a field (12px), 2x for a
media block (16px), 3x for a card (24px), 4x for a large container (32px). Changing the product's
overall softness is then one edit rather than forty.

Be aware of which steps in your framework are actually derived and which are that framework's own
defaults left untouched. A step that looks like it is on the scale but is not will drift the day the
root moves, and nothing will report it.

## 2. Fields get their own token

Inputs, selects and button-shaped fields are a family that may move independently of the card
family — a product can go softer on cards without turning every text input into a pill. Give them a
named field radius even when its current value coincides with a step on the main scale.

Writing the main-scale utility on a field because the number happens to match today is a coincidence
dressed as a decision, and it breaks silently the day the field family moves.

## 3. Concentric — an inner radius is one step below its container

```
card             3x
 media block     2x
  input / field  1.5x
   chip / avatar / switch   fully round
```

The step follows the DEPTH of nesting. This is the concentric-radius rule that hardware and OS design
guidelines have used for decades: for two nested rounded rectangles to look parallel, the inner
radius must equal the outer radius minus the padding between them. Approximating it with one step
down the scale gets close enough at ordinary padding values and stays predictable.

Do not skip a step, and do not pick a radius for a new block by eye. A mismatched inner corner does
not read as a style choice; it reads as a rendering bug, and the reader spends attention deciding
which it is.

## 4. A utility class does nothing against unlayered library CSS

Component libraries frequently ship their radius in plain, unlayered CSS. A utility class from a
framework that puts its utilities inside `@layer utilities` LOSES to any unlayered rule regardless
of specificity — that is the whole design of CSS cascade layers, and unlayered styles win by
definition. So the class is silently ignored: no error, no change, just markup that looks like it is
doing something.

If a library component's corner has to change, change it at the token or at the component's own
custom property, not from the outside. Two minutes spent confirming which layer a rule lives in
saves an afternoon spent adding `!important` to things that were never the problem.

## Related

[[card]] · [[input]] · [[gap]] (the parallel spacing scale, on the same one-root-multiplied-steps
logic).
