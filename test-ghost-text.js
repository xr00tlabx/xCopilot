// xCopilot Ghost Text Test File
// Test various scenarios for ghost text suggestions

// Test 1: Simple function declaration
function calculateSum(a, b) {
    // Cursor here should suggest: return a + b;
}

// Test 2: Conditional statements  
function checkUser(user) {
    if (user && user.isActive) {
        // Cursor here should suggest appropriate action
    }
    
    // Cursor here should suggest else block or next statement
}

// Test 3: Loop structures
function processItems(items) {
    for (let i = 0; i < items.length; i++) {
        // Cursor here should suggest processing logic
    }
    
    // Cursor here should suggest return or next logic
}

// Test 4: Object/Class structures
class UserService {
    constructor() {
        // Cursor here should suggest initialization
    }
    
    async fetchUser(id) {
        // Cursor here should suggest async logic
    }
    
    // Cursor here should suggest new methods
}

// Test 5: Variable declarations
const users = data.filter(
    // Cursor here should suggest filter predicate
);

const result = fetch('/api/users').then(
    // Cursor here should suggest promise handling
);

// Test 6: Console/logging
console.log(
    // Cursor here should suggest log content
);

// Test 7: Error handling
try {
    // Cursor here should suggest try block content
} catch (error) {
    // Cursor here should suggest error handling
}

// Test 8: Arrow functions
const processData = (data) => {
    // Cursor here should suggest function body
};

// Test 9: Async/await patterns
async function loadData() {
    // Cursor here should suggest await patterns
}

// Test 10: Import/Export (if detected)
// Cursor here should suggest imports or exports

/*
Instructions for testing:
1. Open this file in VS Code with xCopilot extension enabled
2. Place cursor at the end of comment lines mentioning "Cursor here"
3. Wait 500ms for ghost text to appear
4. Press Tab to accept or Esc to reject
5. Verify suggestions are contextually appropriate
6. Test multi-line suggestions for functions and classes
7. Test hover tooltips if preview is enabled
8. Test Ctrl+Alt+G to toggle ghost text on/off
*/