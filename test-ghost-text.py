# xCopilot Ghost Text Test File - Python
# Test various Python scenarios for ghost text suggestions

# Test 1: Function definitions
def calculate_sum(a, b):
    # Cursor here should suggest: return a + b

def process_data(df):
    # Cursor here should suggest pandas operations or data processing

# Test 2: Class definitions
class UserService:
    def __init__(self):
        # Cursor here should suggest initialization
    
    def get_user(self, user_id):
        # Cursor here should suggest database query or API call
    
    # Cursor here should suggest new methods

# Test 3: Conditional statements
def check_user(user):
    if user and user.get('active'):
        # Cursor here should suggest appropriate action
    
    # Cursor here should suggest else clause

# Test 4: Loop structures  
def process_items(items):
    for item in items:
        # Cursor here should suggest item processing
    
    # Cursor here should suggest return or next logic

# Test 5: List comprehensions
users = [user for user in data if 
    # Cursor here should suggest filter condition
]

# Test 6: Dictionary operations
user_data = {
    'id': user_id,
    'name': user_name,
    # Cursor here should suggest more fields
}

# Test 7: Exception handling
try:
    # Cursor here should suggest try block content
except Exception as e:
    # Cursor here should suggest error handling

# Test 8: Async functions (Python 3.7+)
async def fetch_data():
    # Cursor here should suggest await patterns

# Test 9: Lambda functions
process_func = lambda x: 
    # Cursor here should suggest lambda body

# Test 10: Import statements
from datetime import 
    # Cursor here should suggest datetime imports

# Test 11: With statements
with open('file.txt', 'r') as file:
    # Cursor here should suggest file operations

"""
Instructions for testing Python ghost text:
1. Open this file in VS Code with xCopilot extension enabled
2. Place cursor at the end of comment lines mentioning "Cursor here"
3. Wait 500ms for ghost text to appear
4. Verify Python-specific suggestions appear
5. Test multi-line function and class suggestions
6. Test context-aware suggestions based on function names
7. Verify language-specific patterns are detected
"""