# API Keys and Security Guide

This document provides guidance on how to handle API keys and sensitive information securely in the Askify project.

## Never commit API keys to version control

- **API keys, passwords, and other secrets should NEVER be committed to your Git repository**
- Always use environment variables or secure secret management systems

## Setting up environment variables

1. Copy the sample environment file:
   ```bash
   cp .env.sample .env
   ```

2. Edit the `.env` file with your actual API keys and credentials:
   ```
   SECRET_KEY="your_generated_secret_key"
   OPENAI_API_KEY="your_openai_api_key"
   SUPABASE_URL="your_supabase_url"
   SUPABASE_KEY="your_supabase_key"
   ```

3. Generate a secure random key using the provided script:
   ```bash
   python scripts/generate_keys.py
   ```

## Obtaining API Keys

### OpenAI API Key
1. Sign up or log in at [OpenAI Platform](https://platform.openai.com/)
2. Navigate to the API section
3. Create a new API key
4. Copy the key and use it in your `.env` file

### Supabase Credentials
1. Sign up or log in at [Supabase](https://app.supabase.io/)
2. Create a new project
3. From the project dashboard, navigate to Settings > API
4. Copy the URL and anon/public key to your `.env` file

## Best Practices

- Use different API keys for development and production
- Regularly rotate your API keys
- Set up usage limits on your API keys to prevent unexpected charges
- Consider using environment-specific `.env` files (e.g., `.env.development`, `.env.production`)
- Use a secret manager for production deployments

## What to do if you accidentally commit API keys

If you accidentally commit API keys or other sensitive information:

1. **Immediately revoke the compromised keys** and generate new ones
2. Remove the keys from your repository history using tools like `git-filter-repo`
3. Force push the changes to your repository
4. Consider the keys compromised and rotate them

## Handling API keys in the extension

The Chrome extension should never directly contain API keys. Instead:

- The extension should communicate with your backend server
- Your backend server manages the API keys and makes authenticated requests
- Use user authentication tokens to authorize extension requests to your backend

## Resources

- [OpenAI API documentation](https://platform.openai.com/docs/api-reference)
- [Supabase documentation](https://supabase.io/docs)
- [GitHub's guide on removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
