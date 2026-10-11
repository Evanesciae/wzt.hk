FROM python:3.12-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PLAYWRIGHT_BROWSERS_PATH=/ms-playwright HOME=/profile
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && playwright install --with-deps chromium && chmod -R a+rX /ms-playwright && useradd -u 10001 -m browser
COPY browser.py .
USER 10001:10001
CMD ["python", "browser.py"]
