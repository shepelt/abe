# Test Fixtures

## React Scaffold

Two versions available:

### 1. react-scaffold.tar.gz (165KB)
- Base scaffold without dependencies
- Requires `npm install` during benchmark (~5-8 seconds)

### 2. react-scaffold-cached.tar.gz (44MB) - OPTIONAL
- Scaffold with pre-installed node_modules
- Speeds up benchmarks by ~5-8 seconds
- Automatically used if present

## Creating Cached Version

To create the cached tarball with pre-installed dependencies:

```bash
cd ~/abe

# Extract scaffold
mkdir temp-scaffold
cd temp-scaffold
tar -xzf ../test-fixtures/react-scaffold.tar.gz

# Install dependencies
npm install

# Create cached tarball
tar -czf ../test-fixtures/react-scaffold-cached.tar.gz .

# Clean up
cd ..
rm -rf temp-scaffold
```

The runner automatically detects and uses the cached version if available.

## Note

The cached version speeds up benchmarks significantly but:
- Creates a 44MB file (vs 165KB)
- May need updates when scaffold dependencies change
- Works across platforms (JavaScript dependencies are portable)
