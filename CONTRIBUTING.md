# Contributing to Askify

Thank you for your interest in contributing to Askify! This document provides guidelines for contributing to the project.

## 🚀 Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/askify.git
   cd askify
   ```
3. **Set up the development environment** following the [INSTALLATION.md](INSTALLATION.md) guide

## 🛠️ Development Setup

### Backend Development
```bash
cd backend
pip install -r requirements.txt
python run.py
```

### Extension Development
1. Load the extension in Chrome developer mode
2. Make changes to files in the `extension/` folder
3. Reload the extension in Chrome to test changes

## 📋 Code Standards

### Python (Backend)
- Follow PEP 8 style guidelines
- Use type hints where possible
- Add docstrings to functions and classes
- Write unit tests for new features

### JavaScript (Extension)
- Use modern ES6+ syntax
- Follow consistent naming conventions
- Add comments for complex logic
- Test thoroughly in Chrome

### CSS
- Use CSS custom properties (variables) for theming
- Follow BEM naming convention where appropriate
- Ensure responsiveness and accessibility

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Clear description** of the issue
2. **Steps to reproduce** the problem
3. **Expected behavior** vs actual behavior
4. **Environment details**:
   - Chrome version
   - Python version
   - Operating system
   - Extension version
5. **Console logs** if applicable
6. **Screenshots** if relevant

## ✨ Feature Requests

For new features, please:

1. **Check existing issues** to avoid duplicates
2. **Describe the feature** and its benefits
3. **Provide use cases** and examples
4. **Consider implementation** complexity
5. **Discuss breaking changes** if any

## 🔧 Pull Request Process

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**:
   - Write clean, documented code
   - Add tests for new functionality
   - Update documentation if needed

3. **Test thoroughly**:
   - Test backend API endpoints
   - Test extension functionality
   - Check for console errors
   - Verify UI/UX changes

4. **Commit with clear messages**:
   ```bash
   git add .
   git commit -m "feat: add new query filtering feature"
   ```

5. **Push and create PR**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Fill out the PR template** with:
   - Description of changes
   - Testing performed
   - Screenshots (if UI changes)
   - Breaking changes (if any)

## 🏗️ Project Structure

```
askify/
├── backend/              # FastAPI backend
│   ├── app/
│   │   ├── api/         # API endpoints
│   │   ├── auth/        # Authentication
│   │   ├── core/        # Configuration
│   │   ├── db/          # Database operations
│   │   ├── models/      # Data models
│   │   └── services/    # Business logic
│   └── scripts/         # Utility scripts
├── extension/           # Chrome extension
│   ├── background/      # Background scripts
│   ├── popup/          # Main UI
│   ├── styles/         # CSS styling
│   └── images/         # Icons and assets
└── srcs/               # Documentation images
```

## 📝 Commit Message Format

Use conventional commits format:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Examples:
```
feat: add support for PDF content extraction
fix: resolve extension popup flickering issue
docs: update installation instructions
style: format code according to PEP 8
refactor: improve query processing performance
test: add unit tests for user authentication
chore: update dependencies to latest versions
```

## 🧪 Testing

### Backend Tests
```bash
cd backend
pytest tests/
```

### Extension Testing
1. Load extension in Chrome developer mode
2. Test on various websites
3. Check console for errors
4. Verify functionality across different page types

## 🚀 Release Process

1. **Version bump** in relevant files
2. **Update changelog** with new features and fixes
3. **Test thoroughly** on multiple environments
4. **Create release** with proper notes
5. **Update extension zip** for distribution

## 📚 Resources

- [Chrome Extension Developer Guide](https://developer.chrome.com/docs/extensions/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [LangChain Documentation](https://python.langchain.com/)
- [Supabase Documentation](https://supabase.com/docs)

## 🤝 Community

- **Be respectful** and inclusive
- **Help others** learn and contribute
- **Share knowledge** and experiences
- **Provide constructive feedback**

## 📞 Questions?

- Open an issue for questions about contributing
- Check existing issues and documentation first
- Be clear and specific in your questions

---

Thank you for contributing to Askify! 🎉
