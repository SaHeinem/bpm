
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Plus, Pencil, ExternalLink, MapPin } from "lucide-react"

// Mock data
const mockRestaurants = [
  {
    id: 1,
    name: "La Bella Vista",
    address: "123 Main St, City, 12345",
    menuLink: "https://example.com/menu1",
    comments: "Italian cuisine, vegetarian options available",
    assignedCount: 12,
    lastUpdated: "2025-01-14T10:30:00",
    updatedBy: "admin@example.com",
  },
  {
    id: 2,
    name: "Sushi Palace",
    address: "456 Oak Ave, City, 12345",
    menuLink: "https://example.com/menu2",
    comments: "Fresh sushi, no pork",
    assignedCount: 11,
    lastUpdated: "2025-01-13T15:20:00",
    updatedBy: "manager@example.com",
  },
  {
    id: 3,
    name: "The Steakhouse",
    address: "789 Elm St, City, 12345",
    menuLink: "https://example.com/menu3",
    comments: "",
    assignedCount: 10,
    lastUpdated: "2025-01-14T09:00:00",
    updatedBy: "system",
  },
]

export function RestaurantManagement() {
  const [restaurants, setRestaurants] = useState(mockRestaurants)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRestaurant, setEditingRestaurant] = useState<(typeof mockRestaurants)[0] | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    menuLink: "",
    comments: "",
  })

  const handleOpenDialog = (restaurant?: (typeof mockRestaurants)[0]) => {
    if (restaurant) {
      setEditingRestaurant(restaurant)
      setFormData({
        name: restaurant.name,
        address: restaurant.address,
        menuLink: restaurant.menuLink,
        comments: restaurant.comments,
      })
    } else {
      setEditingRestaurant(null)
      setFormData({ name: "", address: "", menuLink: "", comments: "" })
    }
    setDialogOpen(true)
  }

  const handleSave = () => {
    if (editingRestaurant) {
      // Update existing
      setRestaurants(
        restaurants.map((r) =>
          r.id === editingRestaurant.id
            ? { ...r, ...formData, lastUpdated: new Date().toISOString(), updatedBy: "admin@example.com" }
            : r,
        ),
      )
    } else {
      // Add new
      const newRestaurant = {
        id: Math.max(...restaurants.map((r) => r.id)) + 1,
        ...formData,
        assignedCount: 0,
        lastUpdated: new Date().toISOString(),
        updatedBy: "admin@example.com",
      }
      setRestaurants([...restaurants, newRestaurant])
    }
    setDialogOpen(false)
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Restaurant Management</h2>
          <p className="text-muted-foreground">Add and manage restaurant locations</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Restaurant
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Restaurants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{restaurants.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Capacity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{restaurants.reduce((sum, r) => sum + r.assignedCount, 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Avg per Restaurant</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(restaurants.reduce((sum, r) => sum + r.assignedCount, 0) / restaurants.length)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Restaurant List */}
      <div className="grid gap-4 md:grid-cols-2">
        {restaurants.map((restaurant) => (
          <Card key={restaurant.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle>{restaurant.name}</CardTitle>
                  <CardDescription className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {restaurant.address}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(restaurant)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {restaurant.menuLink && (
                <a
                  href={restaurant.menuLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  View Menu
                </a>
              )}
              {restaurant.comments && <p className="text-sm text-muted-foreground">{restaurant.comments}</p>}
              <div className="flex items-center justify-between pt-2">
                <Badge variant="outline">{restaurant.assignedCount} people assigned</Badge>
                <p className="text-xs text-muted-foreground">
                  Updated {new Date(restaurant.lastUpdated).toLocaleDateString()}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">Last modified by: {restaurant.updatedBy}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingRestaurant ? "Edit Restaurant" : "Add New Restaurant"}</DialogTitle>
            <DialogDescription>
              {editingRestaurant ? "Update restaurant details" : "Add a new restaurant to the event"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Restaurant Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="La Bella Vista"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Main St, City, 12345"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="menuLink">Menu Link</Label>
              <Input
                id="menuLink"
                type="url"
                value={formData.menuLink}
                onChange={(e) => setFormData({ ...formData, menuLink: e.target.value })}
                placeholder="https://example.com/menu"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comments">Comments</Label>
              <Textarea
                id="comments"
                value={formData.comments}
                onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                placeholder="Special notes about this restaurant..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>{editingRestaurant ? "Update" : "Add"} Restaurant</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
