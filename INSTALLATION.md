# 🚀 Quick Installation Guide for Askify

This guide will help you get Askify up and running on your local machine in just a few minutes.

## 📋 What You'll Need

- **Python 3.8+** installed
- **Google Chrome** browser
- **OpenAI API key** ([Get one here](https://platform.openai.com/api-keys))
- **Supabase account** (optional - [Sign up here](https://supabase.com/))

## ⚡ Quick Setup (5 minutes)

### Step 1: Download and Extract
1. Download the latest release or clone this repository
2. Extract the files to a folder on your computer

### Step 2: Set Up the Backend
```bash
# Navigate to the backend folder
cd backend

# Copy environment template
cp .env.sample .env

# Install Python dependencies
pip install -r requirements.txt

# Generate a secret key
python scripts/generate_keys.py --type=hex
```

### Step 3: Configure Environment
Edit the `.env` file and add your credentials:
```env
# Required
OPENAI_API_KEY=your-openai-api-key-here
SECRET_KEY=the-key-generated-above

# Optional (for user accounts)
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-key
```

### Step 4: Start the Backend
```bash
python run.py
```
You should see: `Uvicorn running on http://0.0.0.0:8000`

### Step 5: Install Chrome Extension
1. Download `askify-extension.zip` from the releases
2. Extract it to a folder
3. Open Chrome → `chrome://extensions/`
4. Enable **Developer mode** (toggle top-right)
5. Click **Load unpacked** → Select the extracted `extension` folder
6. Copy the Extension ID from the extensions page

### Step 6: Update CORS Settings
Add your extension ID to the `.env` file:
```env
ALLOWED_ORIGINS=chrome-extension://YOUR_EXTENSION_ID_HERE,http://localhost:3000
```

Restart the backend:
```bash
python run.py
```

## 🎉 You're Ready!

1. Navigate to any webpage
2. Click the Askify extension icon
3. Sign up/log in
4. Start asking questions about the webpage!

## 🔧 Optional: Database Setup

For user accounts and history storage:

1. Create a [Supabase](https://supabase.com/) project
2. Go to SQL Editor in your Supabase dashboard
3. Run the script from `backend/scripts/supabase_setup.sql`
4. Add your Supabase credentials to the `.env` file
5. Restart the backend

## 🆘 Need Help?

- Check the full [README.md](README.md) for detailed instructions
- Make sure your Python version is 3.8+
- Ensure port 8000 is not being used by another application
- Verify your OpenAI API key is valid and has credits

## 🎯 Quick Test

1. Go to any news article or blog post
2. Click the Askify icon
3. Ask: "What is the main topic of this page?"
4. You should get a relevant answer based on the content!

---

**Happy questioning! 🤖✨**
