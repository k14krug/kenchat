# config.py
import os

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'your_secret_key')
    SQLALCHEMY_DATABASE_URI = 'mysql+pymysql://kenchat_user:your_password@localhost/kenchat_db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', 'your_openai_api_key')
