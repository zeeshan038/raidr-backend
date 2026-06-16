import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

const seedAvatars = async () => {
    try {
        const s3Client = new S3Client({
            region: 'hel1',
            endpoint: 'https://hel1.your-objectstorage.com',
            forcePathStyle: true,
            credentials: {
                accessKeyId: process.env.HETZNER_ACCESS_KEY,
                secretAccessKey: process.env.HETZNER_SECRET_KEY,
            },
        });

        const BUCKET_NAME = 'raidr-assets';
        
        const command = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: 'avatars/',
        });

        const response = await s3Client.send(command);
        
        const items = response.Contents || [];
        const avatarsMap = {};

        items.forEach(item => {
            const key = item.Key; 
            if (!key.endsWith('.png') && !key.endsWith('.jpg')) return;
            
            const filename = key.split('/').pop();
            const match = filename.match(/^(\d+)_(front|back)\./);
            
            if (match) {
                const num = parseInt(match[1]);
                const side = match[2];
                const url = `https://hel1.your-objectstorage.com/${BUCKET_NAME}/${key}`;
                
                if (!avatarsMap[num]) {
                    avatarsMap[num] = {};
                }
                if (side === 'front') {
                    avatarsMap[num].frontUrl = url;
                } else if (side === 'back') {
                    avatarsMap[num].backUrl = url;
                }
            }
        });

        console.log(`Found ${Object.keys(avatarsMap).length} avatars in S3.`);

        for (const numStr of Object.keys(avatarsMap)) {
            const num = parseInt(numStr);
            const data = avatarsMap[num];
            
            if (data.frontUrl && data.backUrl) {
                const requiredLevel = (num <= 2) ? 1 : 2;

                await prisma.avatar.upsert({
                    where: { avatarNumber: num },
                    update: {
                        frontUrl: data.frontUrl,
                        backUrl: data.backUrl,
                        requiredLevel: requiredLevel
                    },
                    create: {
                        avatarNumber: num,
                        frontUrl: data.frontUrl,
                        backUrl: data.backUrl,
                        requiredLevel: requiredLevel
                    }
                });
                console.log(`Upserted Avatar ${num} with requiredLevel ${requiredLevel}`);
            }
        }

        console.log("Avatar seeding complete!");
    } catch (error) {
        console.error("Error seeding avatars:", error);
    } finally {
        await prisma.$disconnect();
    }
};

seedAvatars();
