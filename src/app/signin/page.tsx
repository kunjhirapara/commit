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
        <SignInButton />
      </SignedOut>
      <SignUpButton>
        <button className="bg-purple-700 text-white rounded-full font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 cursor-pointer">
          Sign Up
        </button>
      </SignUpButton>
      <SignedIn>
        <UserButton />
      </SignedIn>
    </div>
  );
}
