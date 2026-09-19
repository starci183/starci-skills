/* Lane v5-5 codemod plan: ui.login.sign-in screen (components/login/sign-in). */
module.exports = [
    {
        file: "src/components/login/sign-in/component.tsx",
        ops: [
            ["sub", "ariaLabel=\"Sign in\"", "ariaLabel={copy.cardLabel}", 1, "signIn.title"],
            ["line", "<Text weight=\"semibold\">Todo app</Text>", "<Text weight=\"semibold\">{copy.brand}</Text>", 1, "shell.brand"],
            ["line", "A steady start.", "{copy.welcomeHeading}", 1, "signIn.welcomeHeading"],
            ["line", "One task at a time.", "{copy.welcomeTagline}", 1, "signIn.welcomeTagline"],
            ["line", "Welcome back", "{copy.formHeading}", 1, "signIn.formHeading"],
            ["line", "Sign in to keep your tasks moving.", "{copy.formTagline}", 1, "signIn.formTagline"],
            ["sub", "label=\"Email\"", "label={copy.emailLabel}", 1, "signIn.email"],
            ["sub", "label=\"Password\"", "label={copy.passwordLabel}", 1, "signIn.password"],
            ["line", "Forgot password?", "{copy.forgotPassword}", 1, "signIn.forgotPassword"],
            ["sub", "? \"Signing in...\" : \"Sign in\"", "? copy.submitting : copy.submit", 1, "signIn.submitting / signIn.submit"],
            ["sub", "<Text size=\"sm\">New here?</Text>", "<Text size=\"sm\">{copy.newHere}</Text>", 1, "signIn.newHere"],
            ["line", "Create an account", "{copy.createAccount}", 1, "signIn.createAccount"],
            ["line", "Privacy policy", "{copy.privacyPolicy}", 1, "shell.legal.privacyPolicy"],
            ["line", "Terms", "{copy.terms}", 1, "shell.legal.terms"],
        ],
    },
]
