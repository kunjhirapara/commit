import { Clock, Code2, Calendar, Users } from "lucide-react";

export const INTERVIEW_CATEGORY = [
  { id: "draft", title: "Draft", variant: "outline" },
  { id: "scheduled", title: "Scheduled", variant: "outline" },
  { id: "rescheduled", title: "Rescheduled", variant: "secondary" },
  { id: "live", title: "Live", variant: "default" },
  { id: "completed", title: "Completed", variant: "secondary" },
  { id: "passed", title: "Passed", variant: "default" },
  { id: "rejected", title: "Rejected", variant: "destructive" },
  { id: "cancelled", title: "Cancelled", variant: "outline" },
  { id: "no_show", title: "No Show", variant: "destructive" },
] as const;

export const INTERVIEW_TEMPLATES = [
  {
    id: "screening",
    label: "Screening",
    durationMinutes: 30,
    description: "Introductory screening focused on experience and fit.",
    instructions:
      "Please join 5 minutes early, test your microphone and camera, and be ready to discuss your recent experience.",
  },
  {
    id: "technical",
    label: "Technical",
    durationMinutes: 60,
    description: "Hands-on coding and technical discussion round.",
    instructions:
      "Bring a stable internet connection, use a laptop or desktop browser, and have your coding environment ready.",
  },
  {
    id: "panel",
    label: "Panel",
    durationMinutes: 75,
    description: "Collaborative panel round with multiple interviewers.",
    instructions:
      "You will meet several team members. Keep your camera on when possible and leave time for Q&A at the end.",
  },
  {
    id: "final",
    label: "Final Round",
    durationMinutes: 45,
    description: "Final decision-making round with hiring stakeholders.",
    instructions:
      "Please review the role summary beforehand and prepare questions about team expectations and next steps.",
  },
] as const;

export const INTERVIEW_STATUS_LABELS = {
  draft: "Draft",
  scheduled: "Scheduled",
  live: "Live",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show",
  rescheduled: "Rescheduled",
  passed: "Passed",
  rejected: "Rejected",
} as const;

export const COMMON_TIMEZONES = [
  "UTC",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Australia/Sydney",
] as const;

export const DEFAULT_BUFFER_MINUTES = {
  before: 15,
  after: 15,
} as const;

export const TIME_SLOTS = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
];

export const QUICK_ACTIONS = [
  {
    icon: Code2,
    title: "New Call",
    description: "Start an instant call",
    color: "primary",
  },
  {
    icon: Users,
    title: "Join Interview",
    description: "Enter via invitation link",
    color: "purple-500",
  },
  {
    icon: Calendar,
    title: "Calendar",
    description: "View your event calendar",
    color: "blue-500",
  },
  {
    icon: Calendar,
    title: "Schedule",
    description: "Plan upcoming interviews",
    color: "blue-500",
  },
  {
    icon: Clock,
    title: "Recordings",
    description: "Access past interviews",
    color: "orange-500",
  },
];

export const CODING_QUESTIONS: CodeQuestion[] = [
  {
    id: "two-sum",
    title: "Two Sum",
    description:
      "Given an array of integers `nums` and an integer `target`, return indices of the two numbers in the array such that they add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.",
    examples: [
      {
        input: "nums = [2,7,11,15], target = 9",
        output: "[0,1]",
        explanation: "Because nums[0] + nums[1] == 9, we return [0, 1]",
      },
      {
        input: "nums = [3,2,4], target = 6",
        output: "[1,2]",
      },
    ],
    starterCode: {
      javascript: `function twoSum(nums, target) {
  // Write your solution here
  
}`,
      python: `def two_sum(nums, target):
    # Write your solution here
    pass`,
      java: `class Solution {
    public int[] twoSum(int[] nums, int target) {
        // Write your solution here
        return null;
    }
}`,
    },
    constraints: [
      "2 ≤ nums.length ≤ 104",
      "-109 ≤ nums[i] ≤ 109",
      "-109 ≤ target ≤ 109",
      "Only one valid answer exists.",
    ],
    functionNames: { javascript: "twoSum", python: "two_sum", java: "twoSum" },
    testCases: [
      { args: [[2, 7, 11, 15], 9], expected: [0, 1], inputLabel: "nums = [2,7,11,15]\ntarget = 9", expectedLabel: "[0,1]" },
      { args: [[3, 2, 4], 6], expected: [1, 2], inputLabel: "nums = [3,2,4]\ntarget = 6", expectedLabel: "[1,2]" },
      { args: [[3, 3], 6], expected: [0, 1], inputLabel: "nums = [3,3]\ntarget = 6", expectedLabel: "[0,1]" },
    ],
    javaMainBody: `
        // Test 1
        __total__++;
        int[] __r1__ = __sol__.twoSum(new int[]{2,7,11,15}, 9);
        boolean __ok1__ = java.util.Arrays.equals(__r1__, new int[]{0,1});
        if(__ok1__) __passed__++;
        System.out.println("Test 1: " + (__ok1__ ? "\u2713 PASS" : "\u2717 FAIL"));
        if(!__ok1__){System.out.println("  Expected: [0, 1]");System.out.println("  Got:      "+java.util.Arrays.toString(__r1__));}

        // Test 2
        __total__++;
        int[] __r2__ = __sol__.twoSum(new int[]{3,2,4}, 6);
        boolean __ok2__ = java.util.Arrays.equals(__r2__, new int[]{1,2});
        if(__ok2__) __passed__++;
        System.out.println("Test 2: " + (__ok2__ ? "\u2713 PASS" : "\u2717 FAIL"));
        if(!__ok2__){System.out.println("  Expected: [1, 2]");System.out.println("  Got:      "+java.util.Arrays.toString(__r2__));}

        // Test 3
        __total__++;
        int[] __r3__ = __sol__.twoSum(new int[]{3,3}, 6);
        boolean __ok3__ = java.util.Arrays.equals(__r3__, new int[]{0,1});
        if(__ok3__) __passed__++;
        System.out.println("Test 3: " + (__ok3__ ? "\u2713 PASS" : "\u2717 FAIL"));
        if(!__ok3__){System.out.println("  Expected: [0, 1]");System.out.println("  Got:      "+java.util.Arrays.toString(__r3__));}
`,
  },
  {
    id: "reverse-string",
    title: "Reverse String",
    description:
      "Write a function that reverses a string. The input string is given as an array of characters `s`.\n\nYou must do this by modifying the input array in-place with O(1) extra memory.",
    examples: [
      {
        input: 's = ["h","e","l","l","o"]',
        output: '["o","l","l","e","h"]',
      },
      {
        input: 's = ["H","a","n","n","a","h"]',
        output: '["h","a","n","n","a","H"]',
      },
    ],
    starterCode: {
      javascript: `function reverseString(s) {
  // Write your solution here
  
}`,
      python: `def reverse_string(s):
    # Write your solution here
    pass`,
      java: `class Solution {
    public void reverseString(char[] s) {
        // Write your solution here
        
    }
}`,
    },
    functionNames: { javascript: "reverseString", python: "reverse_string", java: "reverseString" },
    testCases: [
      { args: [["h","e","l","l","o"]], expected: ["o","l","l","e","h"], inPlace: true, inputLabel: 's = ["h","e","l","l","o"]', expectedLabel: '["o","l","l","e","h"]' },
      { args: [["H","a","n","n","a","h"]], expected: ["h","a","n","n","a","H"], inPlace: true, inputLabel: 's = ["H","a","n","n","a","h"]', expectedLabel: '["h","a","n","n","a","H"]' },
    ],
    javaMainBody: `
        // Test 1
        __total__++;
        char[] __a1__ = new char[]{'h','e','l','l','o'};
        __sol__.reverseString(__a1__);
        boolean __ok1__ = java.util.Arrays.equals(__a1__, new char[]{'o','l','l','e','h'});
        if(__ok1__) __passed__++;
        System.out.println("Test 1: " + (__ok1__ ? "\u2713 PASS" : "\u2717 FAIL"));
        if(!__ok1__){System.out.println("  Expected: ['o','l','l','e','h']");System.out.println("  Got:      "+java.util.Arrays.toString(__a1__));}

        // Test 2
        __total__++;
        char[] __a2__ = new char[]{'H','a','n','n','a','h'};
        __sol__.reverseString(__a2__);
        boolean __ok2__ = java.util.Arrays.equals(__a2__, new char[]{'h','a','n','n','a','H'});
        if(__ok2__) __passed__++;
        System.out.println("Test 2: " + (__ok2__ ? "\u2713 PASS" : "\u2717 FAIL"));
        if(!__ok2__){System.out.println("  Expected: ['h','a','n','n','a','H']");System.out.println("  Got:      "+java.util.Arrays.toString(__a2__));}
`,
  },
  {
    id: "palindrome-number",
    title: "Palindrome Number",
    description:
      "Given an integer `x`, return `true` if `x` is a palindrome, and `false` otherwise.\n\nAn integer is a palindrome when it reads the same forward and backward.",
    examples: [
      {
        input: "x = 121",
        output: "true",
        explanation:
          "121 reads as 121 from left to right and from right to left.",
      },
      {
        input: "x = -121",
        output: "false",
        explanation:
          "From left to right, it reads -121. From right to left, it becomes 121-. Therefore it is not a palindrome.",
      },
    ],
    starterCode: {
      javascript: `function isPalindrome(x) {
  // Write your solution here
  
}`,
      python: `def is_palindrome(x):
    # Write your solution here
    pass`,
      java: `class Solution {
    public boolean isPalindrome(int x) {
        // Write your solution here
        return false;
    }
}`,
    },
    functionNames: { javascript: "isPalindrome", python: "is_palindrome", java: "isPalindrome" },
    testCases: [
      { args: [121],  expected: true,  inputLabel: "x = 121",  expectedLabel: "true"  },
      { args: [-121], expected: false, inputLabel: "x = -121", expectedLabel: "false" },
      { args: [10],   expected: false, inputLabel: "x = 10",   expectedLabel: "false" },
      { args: [0],    expected: true,  inputLabel: "x = 0",    expectedLabel: "true"  },
    ],
    javaMainBody: `
        // Test 1
        __total__++;
        boolean __ok1__ = (__sol__.isPalindrome(121) == true);
        if(__ok1__) __passed__++;
        System.out.println("Test 1: " + (__ok1__ ? "\u2713 PASS" : "\u2717 FAIL"));
        if(!__ok1__){System.out.println("  Expected: true");System.out.println("  Got:      "+__sol__.isPalindrome(121));}

        // Test 2
        __total__++;
        boolean __ok2__ = (__sol__.isPalindrome(-121) == false);
        if(__ok2__) __passed__++;
        System.out.println("Test 2: " + (__ok2__ ? "\u2713 PASS" : "\u2717 FAIL"));
        if(!__ok2__){System.out.println("  Expected: false");System.out.println("  Got:      "+__sol__.isPalindrome(-121));}

        // Test 3
        __total__++;
        boolean __ok3__ = (__sol__.isPalindrome(10) == false);
        if(__ok3__) __passed__++;
        System.out.println("Test 3: " + (__ok3__ ? "\u2713 PASS" : "\u2717 FAIL"));
        if(!__ok3__){System.out.println("  Expected: false");System.out.println("  Got:      "+__sol__.isPalindrome(10));}

        // Test 4
        __total__++;
        boolean __ok4__ = (__sol__.isPalindrome(0) == true);
        if(__ok4__) __passed__++;
        System.out.println("Test 4: " + (__ok4__ ? "\u2713 PASS" : "\u2717 FAIL"));
        if(!__ok4__){System.out.println("  Expected: true");System.out.println("  Got:      "+__sol__.isPalindrome(0));}
`,
  },
];

export const LANGUAGES = [
  { id: "javascript", name: "JavaScript", icon: "/javascript.png" },
  { id: "python", name: "Python", icon: "/python.png" },
  { id: "java", name: "Java", icon: "/java.png" },
] as const;

export interface CodeQuestion {
  id: string;
  title: string;
  description: string;
  examples: Array<{
    input: string;
    output: string;
    explanation?: string;
  }>;
  starterCode: {
    javascript: string;
    python: string;
    java: string;
  };
  constraints?: string[];
  /** Per-language names of the function under test */
  functionNames: { javascript: string; python: string; java: string };
  /** Structured test cases for the auto test runner */
  testCases: Array<{
    args: unknown[];
    expected: unknown;
    inPlace?: boolean;
    inputLabel: string;
    expectedLabel: string;
  }>;
  /** Java statements injected into main() — uses __sol__, __passed__, __total__ */
  javaMainBody: string;
}

export type QuickActionType = (typeof QUICK_ACTIONS)[number];
