# Coral Detector

This project detects corals  in underwater images using SAM and Mask R-CNN. It helps marine researchers automate coral annotation and improve conservation workflows.

---

## Programming stacks

- **Frontend**: React, Next.js, Tailwind CSS  
- **Backend**: Python, Flask

---

### Clone the repo
git clone https://github.com/clcik-click/CIS673_Project.git

### Navigate to the project directory
cd CIS673_Project


CIS673_Project/

├── back-end/              
│       ├── SAM_models/         # You have to download the SAM models separately

│       └── app.py              # Flask server

├── Corals/                 # Coral image data

├── front-end/              # React + Next.js + Tailwind frontend

└── README.md               # This file         

### front-end
cd .\front-end\
npm run dev

### back-end
cd .\back-end\
python app.py

### back-end libraries
pip install flask flask-cors segment-anything torch torchvision scikit-image matplotlib pandas opencv-python numpy


@article{kirillov2023segany,
  title={Segment Anything},
  author={Kirillov, Alexander and Mintun, Eric and Ravi, Nikhila and Mao, Hanzi and Rolland, Chloe and Gustafson, Laura and Xiao, Tete and Whitehead, Spencer and Berg, Alexander C. and Lo, Wan-Yen and Doll{\'a}r, Piotr and Girshick, Ross},
  journal={arXiv:2304.02643},
  year={2023}
}

@misc{matterport_maskrcnn_2017,
  title={Mask R-CNN for object detection and instance segmentation on Keras and TensorFlow},
  author={Waleed Abdulla},
  year={2017},
  publisher={Github},
  journal={GitHub repository},
  howpublished={\url{https://github.com/matterport/Mask_RCNN}},
}