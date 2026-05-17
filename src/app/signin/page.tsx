import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";

export default function Signin() {
  return (
    <div>
      <SignedOut>
        <SignInButton
          forceRedirectUrl="/"
          signUpFallbackRedirectUrl="/"
          signUpForceRedirectUrl="/"
        />
        <SignUpButton
          forceRedirectUrl="/"
          signInFallbackRedirectUrl="/"
          signInForceRedirectUrl="/">
          <button className="bg-purple-700 text-white rounded-full font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 cursor-pointer">
            Sign Up
          </button>
        </SignUpButton>
      </SignedOut>
      <SignedIn>
        <UserButton />
      </SignedIn>
    </div>
  );
}
