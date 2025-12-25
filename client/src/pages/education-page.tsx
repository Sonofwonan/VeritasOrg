import { LayoutShell } from "@/components/layout-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, CheckCircle2, Clock, Award, Zap, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const COURSES = [
  { 
    id: 1, 
    title: "Getting Started with Stocks", 
    level: "Beginner", 
    duration: "2 hours", 
    completion: 100,
    enrolled: true,
    category: "Stocks",
    description: "Learn the fundamentals of stock investing and how to build your first portfolio.",
    lessons: 8,
    completedLessons: 8,
  },
  { 
    id: 2, 
    title: "Advanced Portfolio Management", 
    level: "Advanced", 
    duration: "4 hours", 
    completion: 45,
    enrolled: true,
    category: "Portfolio",
    description: "Master advanced techniques for optimizing and managing a diversified portfolio.",
    lessons: 12,
    completedLessons: 5,
  },
  { 
    id: 3, 
    title: "Options Trading Strategies", 
    level: "Intermediate", 
    duration: "3 hours", 
    completion: 0,
    enrolled: false,
    category: "Options",
    description: "Comprehensive guide to options trading including calls, puts, spreads, and hedging.",
    lessons: 10,
    completedLessons: 0,
  },
  { 
    id: 4, 
    title: "Financial Planning Essentials", 
    level: "Beginner", 
    duration: "1.5 hours", 
    completion: 75,
    enrolled: true,
    category: "Planning",
    description: "Build a solid financial plan for your future with proven strategies.",
    lessons: 6,
    completedLessons: 4,
  },
  { 
    id: 5, 
    title: "Tax-Efficient Investing", 
    level: "Intermediate", 
    duration: "2.5 hours", 
    completion: 30,
    enrolled: true,
    category: "Taxes",
    description: "Learn how to minimize taxes and maximize returns through smart investing.",
    lessons: 8,
    completedLessons: 2,
  },
  {
    id: 6,
    title: "Real Estate Investment Basics",
    level: "Beginner",
    duration: "2 hours",
    completion: 0,
    enrolled: false,
    category: "Real Estate",
    description: "Introduction to real estate as an investment vehicle and wealth building tool.",
    lessons: 7,
    completedLessons: 0,
  },
  {
    id: 7,
    title: "Cryptocurrency and Digital Assets",
    level: "Intermediate",
    duration: "3 hours",
    completion: 0,
    enrolled: false,
    category: "Crypto",
    description: "Understanding blockchain, cryptocurrencies, and their role in modern portfolios.",
    lessons: 9,
    completedLessons: 0,
  },
  {
    id: 8,
    title: "Risk Management Mastery",
    level: "Advanced",
    duration: "3.5 hours",
    completion: 0,
    enrolled: false,
    category: "Risk",
    description: "Advanced techniques for identifying, measuring, and managing investment risks.",
    lessons: 11,
    completedLessons: 0,
  },
];

const ACHIEVEMENTS = [
  { id: 1, title: "First Steps", description: "Complete your first course", icon: "🎓", unlocked: true },
  { id: 2, title: "Dedicated Learner", description: "Complete 3 courses", icon: "📚", unlocked: true },
  { id: 3, title: "Master Investor", description: "Complete 5 courses", icon: "👑", unlocked: false },
  { id: 4, title: "100% Scholar", description: "Achieve 100% on any course", icon: "⭐", unlocked: true },
];

export default function EducationPage() {
  const { toast } = useToast();
  const [courses, setCourses] = useState(COURSES);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const enrolledCourses = courses.filter(c => c.enrolled);
  const availableCourses = courses.filter(c => !c.enrolled);
  
  const filteredCourses = selectedCategory 
    ? courses.filter(c => c.category === selectedCategory)
    : courses;

  const totalProgress = enrolledCourses.length > 0
    ? Math.round(enrolledCourses.reduce((sum, c) => sum + c.completion, 0) / enrolledCourses.length)
    : 0;

  const handleEnrollCourse = (courseId: number) => {
    setCourses(courses.map(c => 
      c.id === courseId ? { ...c, enrolled: true } : c
    ));
    const course = courses.find(c => c.id === courseId);
    toast({
      title: "Successfully Enrolled",
      description: `You're now enrolled in "${course?.title}". Let's start learning!`
    });
  };

  const handleContinueCourse = (courseId: number) => {
    const course = courses.find(c => c.id === courseId);
    toast({
      title: "Course Started",
      description: `Resuming "${course?.title}" at ${course?.completion}% completion.`
    });
  };

  const categories = Array.from(new Set(courses.map(c => c.category)));

  return (
    <LayoutShell>
      <div className="mb-8">
        <h2 className="text-3xl font-bold font-display">Learning Center</h2>
        <p className="text-muted-foreground">Master investing with our comprehensive courses</p>
      </div>

      {/* Learning Overview */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <Card className="border-none shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <BookOpen className="w-5 h-5 text-primary" />
              <Badge>{enrolledCourses.length} Enrolled</Badge>
            </div>
            <p className="text-3xl font-bold font-display">{enrolledCourses.length}</p>
            <p className="text-sm text-muted-foreground">Active Courses</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <Badge variant="outline">{totalProgress}%</Badge>
            </div>
            <p className="text-3xl font-bold font-display">{totalProgress}%</p>
            <p className="text-sm text-muted-foreground">Overall Progress</p>
            <div className="mt-3">
              <Progress value={totalProgress} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <Award className="w-5 h-5 text-amber-600" />
              <Badge variant="secondary">{ACHIEVEMENTS.filter(a => a.unlocked).length}</Badge>
            </div>
            <p className="text-3xl font-bold font-display">{ACHIEVEMENTS.filter(a => a.unlocked).length}</p>
            <p className="text-sm text-muted-foreground">Achievements Unlocked</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="enrolled" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="enrolled" className="gap-2">
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">My Courses</span>
          </TabsTrigger>
          <TabsTrigger value="available" className="gap-2">
            <Zap className="w-4 h-4" />
            <span className="hidden sm:inline">Explore</span>
          </TabsTrigger>
          <TabsTrigger value="achievements" className="gap-2">
            <Award className="w-4 h-4" />
            <span className="hidden sm:inline">Achievements</span>
          </TabsTrigger>
        </TabsList>

        {/* My Courses */}
        <TabsContent value="enrolled" className="space-y-6">
          {enrolledCourses.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-6">
              {enrolledCourses.map(course => (
                <Card key={course.id} className="border-none shadow-lg hover:shadow-xl transition-shadow overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-primary/5 to-blue-600/5">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{course.title}</CardTitle>
                        <CardDescription>{course.description}</CardDescription>
                      </div>
                      {course.completion === 100 && (
                        <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Level</p>
                          <Badge variant={course.level === "Beginner" ? "secondary" : course.level === "Intermediate" ? "outline" : "default"} className="mt-1">
                            {course.level}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Duration</p>
                          <p className="font-medium mt-1">{course.duration}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Lessons</p>
                          <p className="font-medium mt-1">{course.completedLessons}/{course.lessons}</p>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-2">
                          <p className="text-sm font-medium">Progress</p>
                          <p className="text-sm text-muted-foreground">{course.completion}%</p>
                        </div>
                        <Progress value={course.completion} className="h-2" />
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-muted/30 border-t">
                    <Button 
                      className="w-full" 
                      variant={course.completion === 100 ? "outline" : "default"}
                      onClick={() => handleContinueCourse(course.id)}
                      data-testid={`button-continue-course-${course.id}`}
                    >
                      {course.completion === 100 ? "Review Course" : "Continue Learning"}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-none shadow-lg">
              <CardContent className="pt-12 pb-12 text-center">
                <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-lg font-semibold mb-2">No Courses Yet</p>
                <p className="text-muted-foreground mb-6">Start learning by exploring our course library</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Explore Courses */}
        <TabsContent value="available" className="space-y-6">
          <div className="flex gap-2 flex-wrap mb-6">
            <Button 
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
            >
              All Courses
            </Button>
            {categories.map(cat => (
              <Button 
                key={cat}
                variant={selectedCategory === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {filteredCourses.map(course => (
              <Card key={course.id} className="border-none shadow-lg hover:shadow-xl transition-shadow overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-blue-600/5">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{course.title}</CardTitle>
                      <CardDescription>{course.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Level</p>
                      <Badge variant={course.level === "Beginner" ? "secondary" : course.level === "Intermediate" ? "outline" : "default"} className="mt-1">
                        {course.level}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Duration</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        {course.duration}
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Lessons</p>
                      <p className="font-medium mt-1">{course.lessons} lessons</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Category</p>
                      <Badge variant="outline" className="mt-1">{course.category}</Badge>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-muted/30 border-t">
                  {course.enrolled ? (
                    <Button 
                      className="w-full" 
                      variant="outline"
                      onClick={() => handleContinueCourse(course.id)}
                      data-testid={`button-enrolled-course-${course.id}`}
                    >
                      Enrolled
                    </Button>
                  ) : (
                    <Button 
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => handleEnrollCourse(course.id)}
                      data-testid={`button-enroll-course-${course.id}`}
                    >
                      Enroll Now
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Achievements */}
        <TabsContent value="achievements" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {ACHIEVEMENTS.map(achievement => (
              <Card 
                key={achievement.id} 
                className={`border-none shadow-lg transition-all ${achievement.unlocked ? "" : "opacity-60"}`}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className={`text-4xl p-3 rounded-lg ${achievement.unlocked ? "bg-amber-100 dark:bg-amber-950" : "bg-muted"}`}>
                      {achievement.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{achievement.title}</h3>
                      <p className="text-sm text-muted-foreground">{achievement.description}</p>
                      {achievement.unlocked && (
                        <Badge className="mt-2 gap-1" variant="secondary">
                          <CheckCircle2 className="w-3 h-3" />
                          Unlocked
                        </Badge>
                      )}
                      {!achievement.unlocked && (
                        <Badge className="mt-2" variant="outline">
                          Locked
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </LayoutShell>
  );
}
