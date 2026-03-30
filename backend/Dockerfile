# ----------- BUILD STAGE -----------
    FROM node:20 AS builder

    WORKDIR /app
    
    COPY package.json package-lock.json* ./
    RUN npm install
    
    COPY . .
    
    RUN npm run build
    
    
    # ----------- RUNNER STAGE -----------
    FROM node:20
    
    WORKDIR /app
    
    # Install production dependencies
    COPY package.json package-lock.json* ./
    RUN npm install --omit=dev
    
    # Copy build files
    COPY --from=builder /app/dist ./dist
    COPY --from=builder /app/prisma ./prisma
    
    # Generate Prisma in correct environment
    RUN npx prisma generate
    
    # Create uploads folder
    RUN mkdir -p uploads
    
    EXPOSE 3001
    
    CMD ["node", "dist/index.js"]