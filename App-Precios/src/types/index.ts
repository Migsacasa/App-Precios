export interface Product {
    id: number;
    name: string;
    price: number;
    description?: string;
}

export interface User {
    id: number;
    username: string;
    email: string;
}

export interface Order {
    id: number;
    userId: number;
    productIds: number[];
    totalAmount: number;
    orderDate: Date;
}

export type MyType = Record<string, unknown>;