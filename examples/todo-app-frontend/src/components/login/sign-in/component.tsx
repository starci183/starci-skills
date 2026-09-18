import type { FormEvent } from 'react';
import {
  Button,
  GrammarRoot,
  Heading,
  Input,
  MediaFrame,
  PrimaryRailLayout,
  SurfaceCard,
  Text,
  TextAction,
} from '@starci/grammar/common';
import { SIGN_IN_DESTINATIONS, SIGN_IN_TURTLE_SRC } from './destinations';
import {
  SIGN_IN_CREATE_ROW_CLASS,
  SIGN_IN_FOOTER_CLASS,
  SIGN_IN_FOOTER_SEPARATOR_CLASS,
  SIGN_IN_FORGOT_LINK_CLASS,
  SIGN_IN_FORM_CLASS,
  SIGN_IN_FORM_MAIN_CLASS,
  SIGN_IN_FORM_PANEL_CLASS,
  SIGN_IN_HEADING_CLASS,
  SIGN_IN_LINK_RECIPE_CLASS,
  SIGN_IN_MAIN_CLASS,
  SIGN_IN_PASSWORD_FIELD_CLASS,
  SIGN_IN_SUBMIT_WRAP_CLASS,
  SIGN_IN_TURTLE_FRAME_CLASS,
  SIGN_IN_TURTLE_IMAGE_CLASS,
  SIGN_IN_WELCOME_ART_CLASS,
  SIGN_IN_WELCOME_COPY_CLASS,
  SIGN_IN_WELCOME_PANEL_CLASS,
} from './classNames';

/**
 * ui.login.sign-in states: empty, filled, refused, working. Every branch below is one of those four
 * names; there is no fifth rendering path and no attempt to say which half of the pair was wrong when
 * refused, because br.login.password.sign-in must read identically for both refusal causes. The
 * connected owner in ./index.tsx resolves which state applies and hands it down explicitly.
 */
export type SignInScreenState = 'empty' | 'filled' | 'refused' | 'working';

/** The one beside-it inventory the SignInScreenState closed vocabulary is checked against. */
export const SIGN_IN_SCREEN_STATES: ReadonlyArray<SignInScreenState> = ['empty', 'filled', 'refused', 'working'] as const;

/** The public props of the pure sign-in screen view. */
export type SignInScreenViewProps = {
  readonly state: SignInScreenState;
  readonly email: string;
  readonly password: string;
  readonly refusal: string | null;
  readonly onEmailChange: (value: string) => void;
  readonly onPasswordChange: (value: string) => void;
  readonly onSubmit: () => void;
};

/**
 * The pure render of ui.login.sign-in: the settled split-screen direction - turtle welcome panel on
 * the brand canvas in the primary region, the complete sign-in form in the rail - over the published
 * PrimaryRailLayout collapse, where the welcome panel leads the primary-first reading order on
 * mobile. Every one of the four states is decided by the caller's `state`.
 */
export const SignInScreenView = (props: SignInScreenViewProps) => {
  const isWorking = props.state === 'working';
  const unavailable = isWorking || !(props.email && props.password);
  const helper = isWorking
    ? null
    : !props.email && !props.password
      ? 'Enter your email and password to continue.'
      : !props.password
        ? 'Enter your password to continue.'
        : !props.email
          ? 'Enter your email to continue.'
          : null;
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    props.onSubmit();
  };
  return (
    <GrammarRoot theme="light">
      <main className={SIGN_IN_MAIN_CLASS}>
        <PrimaryRailLayout
          railWidth="wide"
          align="stretch"
          collapsedOrder="primary-first"
          primary={
            <div className={SIGN_IN_WELCOME_PANEL_CLASS}>
              <Text weight="semibold">Todo app</Text>
              <div className={SIGN_IN_WELCOME_COPY_CLASS}>
                <Heading level={1} scale="display">
                  A steady start.
                </Heading>
                <Text as="p" size="metric-lead" tone="muted">
                  One task at a time.
                </Text>
              </div>
              <div className={SIGN_IN_WELCOME_ART_CLASS}>
                <MediaFrame aspect="square" fit="contain" treatment="plain" className={SIGN_IN_TURTLE_FRAME_CLASS}>
                  <img src={SIGN_IN_TURTLE_SRC} alt="" className={SIGN_IN_TURTLE_IMAGE_CLASS} />
                </MediaFrame>
              </div>
            </div>
          }
          rail={
            <div className={SIGN_IN_FORM_PANEL_CLASS}>
              <div className={SIGN_IN_FORM_MAIN_CLASS}>
                <div className={SIGN_IN_HEADING_CLASS}>
                  <Heading level={2} scale="display">
                    Welcome back
                  </Heading>
                  <Text as="p" tone="muted">
                    Sign in to keep your tasks moving.
                  </Text>
                </div>
                <SurfaceCard ariaLabel="Sign in" measure="formCompact" frame="frameless">
                  <form onSubmit={onSubmit} data-state={props.state} className={SIGN_IN_FORM_CLASS}>
                    <Input
                      id="sign-in-email"
                      name="email"
                      label="Email"
                      kind="email"
                      value={props.email}
                      isDisabled={isWorking}
                      onValueChange={props.onEmailChange}
                    />
                    <div className={SIGN_IN_PASSWORD_FIELD_CLASS}>
                      <Input
                        id="sign-in-password"
                        name="password"
                        label="Password"
                        kind="password"
                        value={props.password}
                        isDisabled={isWorking}
                        onValueChange={props.onPasswordChange}
                      />
                      <span className={SIGN_IN_FORGOT_LINK_CLASS}>
                        <TextAction appearance="inline" size="md" href={SIGN_IN_DESTINATIONS.forgotPassword}>
                          Forgot password?
                        </TextAction>
                      </span>
                    </div>
                    {props.state === 'refused' ? <Text live="assertive">{props.refusal}</Text> : null}
                    <div className={SIGN_IN_SUBMIT_WRAP_CLASS}>
                      <Button
                        type="submit"
                        variant={unavailable ? 'outline' : 'primary'}
                        width="fill"
                        isDisabled={unavailable}
                        isPending={isWorking}
                      >
                        {isWorking ? 'Signing in...' : 'Sign in'}
                      </Button>
                    </div>
                    {helper === null ? null : (
                      <Text as="p" size="sm" tone="muted">
                        {helper}
                      </Text>
                    )}
                  </form>
                  <div className={SIGN_IN_CREATE_ROW_CLASS}>
                    <Text size="sm">New here?</Text>
                    <span className={SIGN_IN_LINK_RECIPE_CLASS}>
                      <TextAction appearance="inline" size="md" href={SIGN_IN_DESTINATIONS.createAccount}>
                        Create an account
                      </TextAction>
                    </span>
                  </div>
                </SurfaceCard>
              </div>
              <div className={SIGN_IN_FOOTER_CLASS}>
                <span className={SIGN_IN_LINK_RECIPE_CLASS}>
                  <TextAction appearance="muted" href={SIGN_IN_DESTINATIONS.privacyPolicy}>
                    Privacy policy
                  </TextAction>
                </span>
                <span aria-hidden="true" className={SIGN_IN_FOOTER_SEPARATOR_CLASS}>
                  |
                </span>
                <span className={SIGN_IN_LINK_RECIPE_CLASS}>
                  <TextAction appearance="muted" href={SIGN_IN_DESTINATIONS.terms}>
                    Terms
                  </TextAction>
                </span>
              </div>
            </div>
          }
        />
      </main>
    </GrammarRoot>
  );
};
