// Test file for Smart Refactoring Engine
// This file contains various code patterns that should trigger refactoring suggestions

// 1. Long function that should trigger extract method suggestion
function processUserDataLongFunction(userData) {
    // Validate user input
    if (!userData) {
        throw new Error('User data is required');
    }
    if (!userData.email) {
        throw new Error('Email is required');
    }
    if (!userData.name) {
        throw new Error('Name is required');
    }
    if (userData.age < 0) {
        throw new Error('Age must be positive');
    }
    
    // Transform user data
    const normalizedEmail = userData.email.toLowerCase().trim();
    const capitalizedName = userData.name.charAt(0).toUpperCase() + userData.name.slice(1).toLowerCase();
    const formattedAge = parseInt(userData.age);
    
    // Additional validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
        throw new Error('Invalid email format');
    }
    
    // Format user object
    const formattedUser = {
        id: Math.random().toString(36).substr(2, 9),
        email: normalizedEmail,
        name: capitalizedName,
        age: formattedAge,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    // Save to database (simulation)
    console.log('Saving user to database:', formattedUser);
    
    // Send welcome email (simulation)
    console.log('Sending welcome email to:', normalizedEmail);
    
    // Log user creation
    console.log('User created successfully:', formattedUser.id);
    
    return formattedUser;
}

// 2. Old var declarations that should be modernized to const/let
var userName = 'John Doe';
var userAge = 25;
var userEmail = 'john@example.com';

// 3. Old function syntax that should be modernized to arrow functions
var calculateTotal = function(items) {
    var total = 0;
    for (var i = 0; i < items.length; i++) {
        total += items[i].price;
    }
    return total;
};

// 4. Callback pattern that should be modernized to async/await
function fetchUserData(userId, callback) {
    fetch('/api/users/' + userId)
        .then(response => response.json())
        .then(data => callback(null, data))
        .catch(error => callback(error, null));
}

// 5. Duplicate code blocks
function validateEmailAddress(email) {
    if (!email) {
        throw new Error('Email is required');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new Error('Invalid email format');
    }
    return email.toLowerCase().trim();
}

function validateUserEmail(userEmail) {
    if (!userEmail) {
        throw new Error('Email is required');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userEmail)) {
        throw new Error('Invalid email format');
    }
    return userEmail.toLowerCase().trim();
}

// 6. Class that could benefit from Singleton pattern
class DatabaseManager {
    constructor() {
        this.connection = null;
        this.isConnected = false;
    }
    
    connect() {
        if (!this.isConnected) {
            this.connection = 'database-connection';
            this.isConnected = true;
        }
    }
    
    disconnect() {
        if (this.isConnected) {
            this.connection = null;
            this.isConnected = false;
        }
    }
}

// 7. Complex conditional that could be simplified
function getUserStatus(user) {
    if (user.isActive === true && user.emailVerified === true && user.profileComplete === true) {
        if (user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trial') {
            if (user.lastLoginDate && (Date.now() - new Date(user.lastLoginDate).getTime()) < 30 * 24 * 60 * 60 * 1000) {
                return 'premium_active';
            } else {
                return 'premium_inactive';
            }
        } else {
            return 'basic_active';
        }
    } else {
        return 'inactive';
    }
}

// 8. Old concatenation that should use template literals
function generateWelcomeMessage(userName, userEmail) {
    return 'Welcome ' + userName + '! Your email ' + userEmail + ' has been verified. You can now access your dashboard at ' + window.location.origin + '/dashboard';
}