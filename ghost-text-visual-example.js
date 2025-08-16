/**
 * Visual Example of Ghost Text Suggestions in Action
 * This demonstrates how the ghost text would appear in VS Code
 */

// Example 1: Function completion
function calculateSum(a, b) {
    // When user types here, ghost text appears as: "return a + b;"
    |cursor
}

// Example 2: Conditional block
if (user && user.isActive) {
    // Ghost text suggests: "console.log('User is active');"
    // or: "return user.data;"
    |cursor
}

// Example 3: Multi-line class suggestion
class UserService {
    // Ghost text suggests:
    // constructor() {
    //     this.users = [];
    // }
    |cursor
}

// Example 4: Single-line completion
const result = // Ghost text: "calculateSum(5, 10);"
|cursor

// Example 5: Loop structure
for (let i = 0; i < items.length; i++) {
    // Ghost text: "console.log(items[i]);"
    // or: "processItem(items[i]);"
    |cursor
}

/*
VISUAL APPEARANCE:
- Ghost text appears in light gray (40% opacity by default)
- Suggestions appear after 500ms delay (configurable)
- Tab key accepts the suggestion
- Esc key dismisses the suggestion
- Hover shows explanation tooltip (if enabled)
- Smooth fade-in animation when appearing
- Context-aware suggestions based on surrounding code
*/