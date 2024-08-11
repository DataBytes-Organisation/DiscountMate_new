import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";

const discussionTopics = [
  {
    title: "Latest Tech in Supermarkets",
    date: "August 10, 2024",
    description:
      "Discuss the newest technologies being implemented in supermarkets around the world.",
    commentsCount: 15,
    comments: [
      {
        user: "Techie123",
        comment:
          "It's incredible how AI is being used to manage stock levels now!",
      },
      {
        user: "GroceryGuru",
        comment:
          "I saw a robot assisting customers at my local store. The future is here.",
      },
    ],
  },
  {
    title: "Budgeting Tips for Families",
    date: "August 9, 2024",
    description:
      "Share your best budgeting tips that help save money for families.",
    commentsCount: 22,
    comments: [
      {
        user: "SaveMore",
        comment: "Planning meals ahead really helps cut costs!",
      },
      {
        user: "FamilyFirst",
        comment: "We started buying in bulk, saves a lot of money.",
      },
    ],
  },
  // Add more discussion topics here
];

const DiscussionPage = () => {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.pageTitle}>Discussion Topics</Text>
      {discussionTopics.map((topic, index) => (
        <View key={index} style={styles.post}>
          <View style={styles.textContainer}>
            <Text style={styles.postTitle}>{topic.title}</Text>
            <Text style={styles.postDate}>{topic.date}</Text>
            <Text style={styles.postDescription}>{topic.description}</Text>
            <View style={styles.interactionContainer}>
              <TouchableOpacity style={styles.button}>
                <Text style={styles.buttonText}>
                  {topic.commentsCount} Comments
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button}>
                <Text style={styles.buttonText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button}>
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
            </View>
            {topic.comments.map((comment, idx) => (
              <View key={idx} style={styles.comment}>
                <Text style={styles.commentUser}>{comment.user}:</Text>
                <Text style={styles.commentText}>{comment.comment}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f5f5f5",
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  post: {
    backgroundColor: "#ffffff",
    marginBottom: 20,
    borderRadius: 8,
    padding: 10,
  },
  textContainer: {
    flex: 1,
  },
  postTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  postDate: {
    fontSize: 14,
    color: "#888",
    marginVertical: 4,
  },
  postDescription: {
    fontSize: 16,
  },
  interactionContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  button: {
    padding: 8,
    backgroundColor: "#e1e1e1",
    borderRadius: 4,
  },
  buttonText: {
    fontSize: 14,
  },
  comment: {
    marginTop: 5,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderColor: "#ccc",
  },
  commentUser: {
    fontWeight: "bold",
  },
  commentText: {
    fontSize: 14,
  },
});

export default DiscussionPage;
