import zipfile
import pyzipper
import os

def create_test_files():
    # 1. Create a secret file
    secret_content = "This is a secret message!"
    with open("secret.txt", "w") as f:
        f.write(secret_content)
    
    # 2. Create a password-protected ZIP
    password = "password123"
    with pyzipper.AESZipFile("test_protected.zip", "w", compression=pyzipper.ZIP_DEFLATED, encryption=pyzipper.WZ_AES) as zf:
        zf.setpassword(password.encode())
        zf.write("secret.txt")
    
    # 3. Create a wordlist
    words = ["admin", "123456", "qwerty", "password123", "root", "guest"]
    # Add a lot of dummy words to test speed
    with open("test_wordlist.txt", "w") as f:
        for i in range(10000):
            f.write(f"dummy{i}\n")
        for word in words:
            f.write(f"{word}\n")
    
    print(f"Created test_protected.zip and test_wordlist.txt")

if __name__ == "__main__":
    create_test_files()
