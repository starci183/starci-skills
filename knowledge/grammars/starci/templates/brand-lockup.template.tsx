type BrandLockupPresentation = "lockup" | "mark";

type BrandLockupProps = {
  label: string;
  presentation: BrandLockupPresentation;
};

declare const ProtectedBrandArtwork: (props: {
  "aria-label": string;
  presentation: BrandLockupPresentation;
}) => JSX.Element;

export function BrandLockupTemplate({ label, presentation }: BrandLockupProps) {
  return <ProtectedBrandArtwork aria-label={label} presentation={presentation} />;
}

export const brandLockupInvariants = {
  genericIconFallback: false,
  headingTextFallback: false,
  browserIconUsesMark: true,
  paletteOwner: "profile-global-theme",
} as const;
