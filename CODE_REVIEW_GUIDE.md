# xCopilot AI Code Review Assistant - Usage Guide

## 🎯 Overview

The AI Code Review Assistant provides automated code analysis with intelligent scoring and detailed feedback. It analyzes your code for quality, security, best practices, testing coverage, documentation, and performance issues.

## 🚀 Getting Started

### Available Commands

1. **Review Current File** (`Ctrl+K Ctrl+V`)
   - Analyzes the currently open file
   - Provides detailed score and issue breakdown
   - Command: `xCopilot: Review do Arquivo Atual`

2. **Review Changed Files** (`Ctrl+K Ctrl+Shift+V`)
   - Analyzes all Git-modified files
   - Perfect for pre-commit reviews
   - Command: `xCopilot: Review dos Arquivos Modificados`

3. **Review Workspace**
   - Analyzes all code files in workspace (up to 50 files)
   - Provides comprehensive project health check
   - Command: `xCopilot: Review do Workspace`

4. **Generate Review Summary**
   - Creates AI-powered summary of changes
   - Analyzes Git diff and provides impact assessment
   - Command: `xCopilot: Gerar Summary de Review`

### Context Menu Access

Right-click in any code file to access:
- **xCopilot Review** options in the context menu
- Available in editor and file explorer

## 📊 Review Analysis Categories

### 1. Code Quality (Weight: High)
- **Function Length**: Detects functions > 20 lines
- **Cyclomatic Complexity**: Identifies complex conditional logic
- **Code Duplication**: Finds repeated code patterns
- **Readability Issues**: Analyzes code structure

### 2. Security (Weight: Critical)
- **SQL Injection**: Detects unsafe query construction
- **Hardcoded Credentials**: Finds embedded passwords/keys
- **Eval Usage**: Identifies dangerous `eval()` calls
- **Input Validation**: Checks for unsafe operations

### 3. Best Practices (Weight: Medium)
- **Magic Numbers**: Detects unexplained numeric literals
- **Variable Naming**: Identifies short/unclear names
- **Design Patterns**: Checks SOLID principles adherence
- **Code Organization**: Analyzes structure quality

### 4. Testing (Weight: Medium)
- **Missing Tests**: Identifies untested public functions
- **Test Coverage**: Analyzes test completeness
- **Test Quality**: Reviews test structure

### 5. Documentation (Weight: Low)
- **JSDoc/Comments**: Checks function documentation
- **README Updates**: Verifies documentation currency
- **Code Comments**: Analyzes inline explanations

### 6. Performance (Weight: Medium)
- **Nested Loops**: Identifies O(n²) patterns
- **Inefficient Operations**: Finds suboptimal code
- **Memory Usage**: Analyzes resource consumption

## 🎯 Scoring System

### Overall Score Calculation
- **100 Points**: Perfect code
- **90-99**: Excellent quality
- **80-89**: Good quality
- **70-79**: Acceptable quality
- **60-69**: Needs improvement
- **Below 60**: Requires significant work

### Penalty System
- **Critical Issues**: -20 points each
- **High Issues**: -10 points each
- **Medium Issues**: -5 points each
- **Low Issues**: -2 points each

### Category Scores
Each category (Code Quality, Security, etc.) gets its own score, allowing you to see specific areas for improvement.

## 📋 Review Output

### Interactive Results
1. **Score Display**: Overall score with color coding
2. **Category Breakdown**: Individual scores per analysis type
3. **Issue Summary**: Count by severity level
4. **Action Options**: 
   - View detailed results
   - Export markdown report
   - Close review

### Detailed Reports
Generated markdown reports include:
- Executive summary with scores
- Complete issue listing by category
- Specific suggestions for each problem
- File-by-file analysis
- Actionable recommendations

### Export Functionality
- **Markdown Reports**: Full analysis in readable format
- **Timestamped Files**: Auto-named with creation time
- **Workspace Integration**: Saves to workspace root

## ⚙️ Configuration

### Available Settings
```json
{
  "xcopilot.codeReview.enabled": true,
  "xcopilot.codeReview.autoReviewOnSave": false,
  "xcopilot.codeReview.minScore": 70,
  "xcopilot.codeReview.enabledChecks": {
    "codeSmells": true,
    "bestPractices": true,
    "testing": true,
    "documentation": true,
    "security": true,
    "performance": true
  }
}
```

### Configuration Options

- **enabled**: Enable/disable code review features
- **autoReviewOnSave**: Automatically review files on save
- **minScore**: Minimum score for auto-approval (0-100)
- **enabledChecks**: Toggle specific analysis categories

## 🔧 Best Practices

### When to Use
1. **Before Commits**: Review changed files to catch issues early
2. **Code Reviews**: Generate reports for team review
3. **Refactoring**: Analyze code quality during improvements
4. **New Features**: Validate new code meets standards

### Interpreting Results
1. **Focus on Critical/High**: Address security and major quality issues first
2. **Security First**: Always fix security vulnerabilities immediately
3. **Gradual Improvement**: Work on medium/low issues over time
4. **Team Standards**: Use scores to maintain consistent quality

### Integration Workflow
1. **Development**: Use current file review during coding
2. **Pre-commit**: Review changed files before committing
3. **CI/CD**: Integrate workspace review in build process
4. **Code Reviews**: Generate summaries for PR discussions

## 🎯 Example Workflow

```bash
# 1. During development
Ctrl+K Ctrl+V (review current file)

# 2. Before committing
Ctrl+K Ctrl+Shift+V (review changed files)

# 3. Generate PR summary
Command Palette > "xCopilot: Gerar Summary de Review"

# 4. Export for team review
View Details > Export Report
```

## 🚨 Common Issues and Solutions

### Low Scores
- **Review Security Issues**: Fix critical security problems first
- **Simplify Complex Functions**: Break down large functions
- **Add Documentation**: Include JSDoc for public functions
- **Write Tests**: Add unit tests for untested code

### Performance Tips
- **Batch Analysis**: Review workspace during off-hours
- **Selective Review**: Focus on changed files for speed
- **Configuration**: Disable unnecessary checks for faster analysis

## 🔄 Integration with xCopilot

The Code Review Assistant integrates seamlessly with other xCopilot features:
- **Code Suggestions**: Uses review findings for better suggestions
- **Pattern Detection**: Leverages existing pattern analysis
- **Git Integration**: Works with Git status and diffs
- **AI Backend**: Powered by OpenAI for intelligent analysis

## 📞 Support

For issues or feature requests:
- GitHub Issues: [xCopilot Repository](https://github.com/xr00tlabx/xCopilot/issues)
- Documentation: Check the main README for setup instructions
- Configuration: See VS Code settings for customization options