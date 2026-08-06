export const redisClient = {
    isOpen: false,
    connect: async () => {},
    on: () => {},
    hGetAll: async () => ({}),
    hDel: async () => {},
    sMembers: async () => [],
    sRem: async () => {}
} as any;

export const initRedis = async () => {
    console.log('Redis is deprecated in this architecture. Skipping connection.');
};
