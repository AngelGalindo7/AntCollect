import os
import boto3
from dotenv import load_dotenv
from botocore.exceptions import ClientError

load_dotenv()

def setup_local_s3():
    endpoint_url = os.getenv("AWS_ENDPOINT_URL")
    bucket = os.getenv("AWS_S3_BUCKET")
    
    if not bucket:
        print("ERROR: AWS_S3_BUCKET is not set in your .env file.")
        return

    print(f"--- S3 Setup/Test ---")
    print(f"Bucket:   {bucket}")
    print(f"Endpoint: {endpoint_url}")
    
    s3 = boto3.client(
        "s3",
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID", "test"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY", "test"),
        region_name=os.getenv("AWS_REGION", "us-east-1"),
        endpoint_url=endpoint_url
    )
    
    try:
        # Check if bucket exists
        print(f"Checking if bucket '{bucket}' exists...")
        s3.head_bucket(Bucket=bucket)
        print("SUCCESS: Bucket already exists.")
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == '404' or error_code == 'NoSuchBucket':
            print(f"Bucket missing. Attempting to create '{bucket}'...")
            try:
                s3.create_bucket(Bucket=bucket)
                print("SUCCESS: Bucket created successfully.")
            except Exception as create_err:
                print(f"FAILED to create bucket: {create_err}")
                return
        else:
            print(f"ERROR checking bucket: {e}")
            return

    # Ensure bucket is public for local development
    print(f"Ensuring bucket '{bucket}' has public read permissions...")
    try:
        # 1. Disable Public Access Block
        s3.delete_public_access_block(Bucket=bucket)
        
        # 2. Set Public Read Policy
        import json
        bucket_policy = {
            "Version": "2012-10-17",
            "Statement": [{
                "Sid": "PublicRead",
                "Effect": "Allow",
                "Principal": "*",
                "Action": ["s3:GetObject"],
                "Resource": [f"arn:aws:s3:::{bucket}/*"]
            }]
        }
        s3.put_bucket_policy(Bucket=bucket, Policy=json.dumps(bucket_policy))
        
        # 3. Set ACL
        s3.put_bucket_acl(Bucket=bucket, ACL='public-read')
        print("SUCCESS: Public permissions applied.")
    except Exception as perm_err:
        print(f"WARNING: Could not set public permissions: {perm_err}")

    # Final test: Upload/Delete
    try:
        s3.put_object(Bucket=bucket, Key="test_file.txt", Body="hello")
        s3.delete_object(Bucket=bucket, Key="test_file.txt")
        print("SUCCESS: S3 Upload/Delete test passed!")
    except Exception as e:
        print(f"FAILED functional test: {e}")

if __name__ == "__main__":
    setup_local_s3()
