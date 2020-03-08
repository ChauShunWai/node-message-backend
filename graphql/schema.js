const { buildSchema } = require('graphql');

module.exports = buildSchema(`
  type Post {
    _id: ID!
    title: String!
    content: String!
    image: String!
    creator: User!
    createdAt: String!
    updatedAt: String!
  }

  type User {
    _id: ID!
    name: String!
    email: String!
    password: String
    status: String!
    posts: [Post!]!
  }

  type PostData {
    posts: [Post!]!
    totalPosts: Int!
  }

  type AuthData {
    token: String!
    userId: String!
  }

  input UserInputData {
    email: String!
    name: String!
    password: String!
  }

  input PostInputData {
    title: String!
    content: String!
    image: String!
  }

  type RootMutation {
    createUser(userInput: UserInputData): User!
    createPost(postInput: PostInputData): Post!
    updatePost(postId: ID!, postInput: PostInputData): Post!
    deletePost(postId: ID!): Boolean
    updateStatus(status: String!): User!
  }

  type RootQuery {
    login(email: String!, password: String!): AuthData!
    posts(page: Int!): PostData!
    post(postId: ID!): Post!
    user: User!
  }

  schema {
    query: RootQuery
    mutation: RootMutation
  }
`);
